/**
 * Cloudflare Worker auth adapter. Secrets are environment bindings only.
 */
import {
  CURRENT_KID,
  MAX_BODY_BYTES,
  MAX_PASSWORD_LEN,
  MAX_SESSION_TTL_MS,
  RATE_MAX_ATTEMPTS,
  isLegacyAllowed,
  isOriginAllowed,
  normalizeOrigin,
  parseAllowedOrigins,
  parseTokenParts,
  validateTokenShape,
} from '../shared/auth-core.mjs';

import { isSharedTokenRevoked, revokeSharedToken, sharedAttempt } from '../shared/auth-store.mjs';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function methods(env) {
  return String(env.CORS_METHODS || 'GET, POST, OPTIONS').split(',').map((method) => method.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const headers = {
    'Access-Control-Allow-Methods': methods(env).join(', '),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  const origin = normalizeOrigin(request.headers.get('Origin'));
  if (origin && parseAllowedOrigins(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN).includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function originAllowed(request, env) {
  return isOriginAllowed(request.headers.get('Origin'), parseAllowedOrigins(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN));
}

function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}

function methodNotAllowed(allow, headers) {
  return json({ ok: false, error: 'method_not_allowed' }, 405, { ...headers, Allow: allow.join(', ') });
}

function timingSafeEqual(a, b) {
  const aa = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64Url(bytes) {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSign(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return base64Url(new Uint8Array(sig));
}

function sessionSecret(env) { return env.SESSION_SECRET || ''; }

function sitePassword(env) {
  return env.PASS_W || '';
}

function secretMap(env) {
  let secrets = {};
  if (env.SESSION_SECRETS) {
    try {
      secrets = env.SESSION_SECRETS.trim().startsWith('{')
        ? JSON.parse(env.SESSION_SECRETS)
        : Object.fromEntries(env.SESSION_SECRETS.split(',').map((pair) => pair.split(/:(.+)/)).filter(([kid, secret]) => kid && secret));
    } catch { /* invalid maps cannot verify any additional keys */ }
  }
  if (env.SESSION_SECRET) secrets[env.CURRENT_KID || CURRENT_KID] = env.SESSION_SECRET;
  return secrets;
}

async function createSessionToken(secret, env) {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomUUID();
  const kid = env.CURRENT_KID || CURRENT_KID;
  const payload = `${kid}.${exp}.${nonce}`;
  const sig = await hmacSign(secret, payload);
  return { token: `${payload}.${sig}`, expiresAt: exp };
}

async function verifySessionToken(env, token) {
  if (!validateTokenShape(token).ok) return false;
  const parsed = parseTokenParts(token);
  const now = Date.now();
  if (!parsed || !Number.isSafeInteger(parsed.exp) || parsed.exp <= now || parsed.exp - now > MAX_SESSION_TTL_MS) return false;
  if (parsed.kind === 'legacy' && !isLegacyAllowed(env.ALLOW_LEGACY_TOKENS)) return false;
  const secret = parsed.kind === 'legacy' ? sessionSecret(env) : secretMap(env)[parsed.kid];
  return Boolean(secret) && timingSafeEqual(parsed.sig, await hmacSign(secret, parsed.payload));
}

async function parseJsonBody(request) {
  const reader = request.body?.getReader?.();
  if (!reader) {
    try {
      return await request.json();
    } catch {
      return null;
    }
  }

  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      return null;
    }
    chunks.push(value);
  }

  try {
    const merged = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const text = new TextDecoder().decode(merged);
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

function requestToken(request, body) {
  const auth = request.headers.get('Authorization') || '';
  const cookie = (request.headers.get('Cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('couple_spin_session='))?.slice('couple_spin_session='.length);
  try {
    return String(body?.token || (auth.startsWith('Bearer ') ? auth.slice(7).trim() : '') || (cookie ? decodeURIComponent(cookie) : '') || '').trim();
  } catch {
    return '';
  }
}

async function denyToken(env, token) {
  if (!await verifySessionToken(env, token)) return;
  const ttl = Math.max(1, Math.ceil((parseTokenParts(token).exp - Date.now()) / 1000));
  await revokeSharedToken(env, `auth-deny:${await hash(token)}`, ttl);
}

const CLEAR_COOKIE = 'couple_spin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      if (!originAllowed(request, env)) {
        return json({ ok: false, error: 'origin_forbidden' }, 403);
      }
      return new Response(null, { status: 204, headers: cors });
    }

    if (!originAllowed(request, env) && request.headers.get('Origin')) {
      return json({ ok: false, error: 'origin_forbidden' }, 403);
    }

    if (url.pathname === '/health') {
      if (request.method !== 'GET') return methodNotAllowed(['GET', 'OPTIONS'], cors);
      return json({ ok: true }, 200, cors);
    }

    if (url.pathname === '/session') {
      const secret = sessionSecret(env);
      if (!secret) return json({ ok: false, error: 'not_configured' }, 503, cors);

      let body;
      if (request.method === 'GET') {
      } else if (request.method === 'POST') {
        body = await parseJsonBody(request);
        if (!body) return json({ ok: false, error: 'bad_request' }, 400, cors);
      } else {
        return methodNotAllowed(['GET', 'POST', 'OPTIONS'], cors);
      }

      const token = requestToken(request, body);
      if (!token) return json({ ok: false, error: 'missing_token' }, 401, cors);
      const valid = await verifySessionToken(env, token);
      try {
        if (!valid || await isSharedTokenRevoked(env, `auth-deny:${await hash(token)}`)) {
          return json({ ok: false, error: 'invalid_session' }, 401, cors);
        }
      } catch {
        return json({ ok: false, error: 'auth_store_unavailable' }, 503, cors);
      }
      return json({ ok: true }, 200, cors);
    }

    if (url.pathname === '/verify') {
      if (request.method !== 'POST') return methodNotAllowed(['POST', 'OPTIONS'], cors);
      let rate;
      try {
        rate = await sharedAttempt(env, `auth-rate:${await hash(clientIp(request))}`, RATE_MAX_ATTEMPTS);
      } catch {
        return json({ ok: false, error: 'auth_store_unavailable' }, 503, cors);
      }
      if (!rate.allowed) {
        return json(
          { ok: false, error: 'rate_limited', retryAfterSec: rate.retryAfterSec },
          429,
          { ...cors, 'Retry-After': String(rate.retryAfterSec) },
        );
      }

      const body = await parseJsonBody(request);
      if (!body) return json({ ok: false, error: 'bad_request' }, 400, cors);

      const input = String(body.password ?? '').trim();
      const expected = sitePassword(env);
      const signing = sessionSecret(env);

      if (!expected || !signing) return json({ ok: false, error: 'not_configured' }, 503, cors);
      if (!input || input.length > MAX_PASSWORD_LEN) {
        return json({ ok: false, error: 'bad_request' }, 400, cors);
      }

      if (timingSafeEqual(input, expected)) {
        const session = await createSessionToken(signing, env);
        return json(
          { ok: true, token: session.token, expiresAt: session.expiresAt },
          200,
          { ...cors, 'Set-Cookie': `couple_spin_session=${encodeURIComponent(session.token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor((session.expiresAt - Date.now()) / 1000)}` },
        );
      }

      return json({ ok: false, error: 'wrong_password' }, 401, cors);
    }

    if (url.pathname === '/logout') {
      if (request.method !== 'POST') return methodNotAllowed(['POST', 'OPTIONS'], cors);
      const body = await parseJsonBody(request);
      if (body === null) return json({ ok: false, error: 'bad_request' }, 400, { ...cors, 'Set-Cookie': CLEAR_COOKIE });
      const token = requestToken(request, body);
      try {
        if (token) await denyToken(env, token);
      } catch {
        return json({ ok: false, error: 'auth_store_unavailable' }, 503, cors);
      }
      return json({ ok: true }, 200, { ...cors, 'Set-Cookie': CLEAR_COOKIE });
    }

    return json({ ok: false, error: 'not_found' }, 404, cors);
  },
};
