/**
 * Shared auth helpers for Vercel serverless functions.
 * SITE_PASSWORD / SESSION_SECRET live only in env — never in the client bundle.
 */

import { createHmac, createHash, randomUUID, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_PASSWORD_LEN = 256;
export const MAX_BODY_BYTES = 4096;

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 12;
const rateByKey = new Map();

const DEFAULT_ALLOWED = [
  'https://couple-spin.vercel.app',
  'https://double-game-black.vercel.app',
  'https://elia448811-coder.github.io',
];

function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '';
  const list = raw
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
  return list.length ? list : DEFAULT_ALLOWED;
}

export function resolveRequestOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null;
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

/** Strict allowlist — never reflect arbitrary Origin */
export function cors(req) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };

  const requestOrigin = resolveRequestOrigin(req);
  const allowed = parseAllowedOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  }
  return headers;
}

export function isOriginAllowed(req) {
  const requestOrigin = resolveRequestOrigin(req);
  if (!requestOrigin) return true; // same-origin / non-browser
  return parseAllowedOrigins().includes(requestOrigin);
}

export function json(res, status, data, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return nodeTimingSafeEqual(aa, bb);
}

export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function pruneRateMap(now) {
  if (rateByKey.size < 500) return;
  for (const [key, entry] of rateByKey) {
    if (now > entry.resetAt) rateByKey.delete(key);
  }
}

/** In-memory rate limit with cleanup + exponential backoff hint */
export function checkRateLimit(ip) {
  const now = Date.now();
  pruneRateMap(now);
  const key = createHash('sha256').update(String(ip)).digest('hex').slice(0, 24);
  let entry = rateByKey.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateByKey.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > RATE_MAX_ATTEMPTS) {
    const over = entry.count - RATE_MAX_ATTEMPTS;
    const backoff = Math.min(900, 30 * 2 ** Math.min(over, 5));
    return { allowed: false, retryAfterSec: Math.max(backoff, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

function hmacSign(secret, message) {
  return createHmac('sha256', secret).update(message).digest('base64url');
}

export function sessionSigningSecret() {
  return process.env.SESSION_SECRET || process.env.SITE_PASSWORD || process.env.PASS_W || '';
}

export function sitePassword() {
  return process.env.SITE_PASSWORD || process.env.PASS_W || '';
}

export function createSessionToken(secret) {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = randomUUID();
  const kid = 'v1';
  const payload = `${kid}.${exp}.${nonce}`;
  const sig = hmacSign(secret, payload);
  return { token: `${payload}.${sig}`, expiresAt: exp };
}

export function verifySessionToken(secret, token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length === 3) {
    // legacy: exp.nonce.sig
    const [expStr, nonce, sig] = parts;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    const payload = `${expStr}.${nonce}`;
    return timingSafeEqual(sig, hmacSign(secret, payload));
  }
  if (parts.length === 4) {
    const [kid, expStr, nonce, sig] = parts;
    if (kid !== 'v1') return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    const payload = `${kid}.${expStr}.${nonce}`;
    return timingSafeEqual(sig, hmacSign(secret, payload));
  }
  return false;
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;

    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
    };

    const fail = (err) => {
      if (done) return;
      done = true;
      cleanup();
      try {
        req.destroy?.();
      } catch {
        /* ignore */
      }
      reject(err);
    };

    const onData = (c) => {
      if (done) return;
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        fail(new Error('too_large'));
        return;
      }
      chunks.push(c);
    };

    const onEnd = () => {
      if (done) return;
      done = true;
      cleanup();
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('bad_json'));
      }
    };

    const onError = (e) => fail(e);

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}
