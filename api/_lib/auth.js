/**
 * Shared auth helpers for Vercel serverless functions.
 * SITE_PASSWORD lives only in Vercel env — never in the client bundle.
 */

import { createHmac, randomUUID, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_PASSWORD_LEN = 256;

const rateByIp = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 12;

export function cors(req) {
  const origin = req.headers.origin || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
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

export function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateByIp.set(ip, entry);
  }
  entry.count += 1;
  if (entry.count > RATE_MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

function hmacSign(secret, message) {
  return createHmac('sha256', secret).update(message).digest('base64url');
}

export function createSessionToken(secret) {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = randomUUID();
  const payload = `${exp}.${nonce}`;
  const sig = hmacSign(secret, payload);
  return { token: `${payload}.${sig}`, expiresAt: exp };
}

export function verifySessionToken(secret, token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const payload = `${expStr}.${nonce}`;
  const expected = hmacSign(secret, payload);
  return timingSafeEqual(sig, expected);
}

export function sitePassword() {
  return process.env.SITE_PASSWORD || process.env.PASS_W || '';
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 4096) {
        reject(new Error('too_large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('bad_json'));
      }
    });
    req.on('error', reject);
  });
}
