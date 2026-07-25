/**
 * Cloudflare Worker auth — PASS_W + optional SESSION_SECRET.
 * Exact-match CORS allowlist. Stream body limit. Rate limit + cleanup.
 */

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PASSWORD_LEN = 256;
const MAX_BODY_BYTES = 4096;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 12;

/** @type {Map<string, { count: number; resetAt: number }>} */
const rateByIp = new Map();

function parseAllowedList(env) {
  const raw = env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || '';
  return String(raw)
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
}

function requestOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function corsHeaders(request, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };

  const origin = requestOrigin(request);
  const allowed = parseAllowedList(env);
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function originAllowed(request, env) {
  const origin = requestOrigin(request);
  if (!origin) return true;
  return parseAllowedList(env).includes(origin);
}

function json(data, status, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function pruneRate(now) {
  if (rateByIp.size < 500) return;
  for (const [k, v] of rateByIp) {
    if (now > v.resetAt) rateByIp.delete(k);
  }
}

function checkRateLimit(ip) {
  const now = Date.now();
  pruneRate(now);
  let entry = rateByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateByIp.set(ip, entry);
  }
  entry.count += 1;
  if (entry.count > RATE_MAX_ATTEMPTS) {
    const over = entry.count - RATE_MAX_ATTEMPTS;
    const backoff = Math.min(900, 30 * 2 ** Math.min(over, 5));
    return {
      allowed: false,
      retryAfterSec: Math.max(backoff, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
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

function sessionSecret(env) {
  return env.SESSION_SECRET || env.PASS_W || '';
}

function sitePassword(env) {
  return env.PASS_W || '';
}

async function createSessionToken(secret) {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomUUID();
  const kid = 'v1';
  const payload = `${kid}.${exp}.${nonce}`;
  const sig = await hmacSign(secret, payload);
  return { token: `${payload}.${sig}`, expiresAt: exp };
}

async function verifySessionToken(secret, token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length === 3) {
    const [expStr, nonce, sig] = parts;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    const expected = await hmacSign(secret, `${expStr}.${nonce}`);
    return timingSafeEqual(sig, expected);
  }
  if (parts.length === 4) {
    const [kid, expStr, nonce, sig] = parts;
    if (kid !== 'v1') return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    const expected = await hmacSign(secret, `${kid}.${expStr}.${nonce}`);
    return timingSafeEqual(sig, expected);
  }
  return false;
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

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, gate: Boolean(sitePassword(env)), sessionTtlHours: 24 }, 200, cors);
    }

    if (url.pathname === '/session') {
      const secret = sessionSecret(env);
      if (!secret) return json({ ok: false, error: 'not_configured' }, 503, cors);

      let token = '';
      if (request.method === 'GET') {
        const auth = request.headers.get('Authorization') || '';
        token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      } else if (request.method === 'POST') {
        const body = await parseJsonBody(request);
        token = String(body?.token ?? '').trim();
      } else {
        return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
      }

      if (!token) return json({ ok: false, error: 'missing_token' }, 401, cors);
      const valid = await verifySessionToken(secret, token);
      if (!valid) return json({ ok: false, error: 'invalid_session' }, 401, cors);
      return json({ ok: true }, 200, cors);
    }

    if (url.pathname === '/verify' && request.method === 'POST') {
      const rate = checkRateLimit(clientIp(request));
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
        const session = await createSessionToken(signing);
        return json({ ok: true, token: session.token, expiresAt: session.expiresAt }, 200, cors);
      }

      return json({ ok: false, error: 'wrong_password' }, 401, cors);
    }

    return json({ ok: false, error: 'not_found' }, 404, cors);
  },
};
