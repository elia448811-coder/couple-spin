/** Serverless adapter for the shared authentication primitives. */
import { createHash, createHmac, randomUUID, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import {
  CURRENT_KID,
  MAX_BODY_BYTES,
  MAX_PASSWORD_LEN,
  MAX_SESSION_TTL_MS,
  RATE_MAX_ATTEMPTS,
  RATE_WINDOW_MS,
  isLegacyAllowed,
  isOriginAllowed as coreOriginAllowed,
  normalizeOrigin,
  parseAllowedOrigins,
  parseTokenParts,
  validateTokenShape,
} from '../../shared/auth-core.mjs';

export { MAX_BODY_BYTES, MAX_PASSWORD_LEN };
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const rateByKey = new Map();
const deniedTokens = new Map();
const production = () => process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const currentKid = () => process.env.CURRENT_KID || CURRENT_KID;

function configuredMethods(methods) {
  return Array.isArray(methods) ? methods : String(process.env.CORS_METHODS || 'GET, POST, OPTIONS').split(',').map((m) => m.trim()).filter(Boolean);
}

export function resolveRequestOrigin(req) {
  return normalizeOrigin(req.headers.origin);
}

/** Strict allowlist — an Origin is echoed only after exact normalized matching. */
export function cors(req, methods) {
  const allowedMethods = configuredMethods(methods);
  const headers = {
    'Access-Control-Allow-Methods': allowedMethods.join(', '),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
  const origin = resolveRequestOrigin(req);
  if (origin && parseAllowedOrigins(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function isOriginAllowed(req) {
  return coreOriginAllowed(req.headers.origin, parseAllowedOrigins(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN));
}

export function json(res, status, data, headers = {}) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function methodNotAllowed(res, allow, headers = {}) {
  json(res, 405, { ok: false, error: 'method_not_allowed' }, { ...headers, Allow: Array.isArray(allow) ? allow.join(', ') : allow });
}

export function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && nodeTimingSafeEqual(aa, bb);
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return typeof forwarded === 'string' && forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
}

function hashedKey(prefix, value) {
  return `${prefix}:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function memoryRateLimit(ip) {
  const now = Date.now();
  if (rateByKey.size >= 500) for (const [key, entry] of rateByKey) if (now > entry.resetAt) rateByKey.delete(key);
  const key = hashedKey('rate', ip);
  let entry = rateByKey.get(key);
  if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
  entry.count += 1;
  rateByKey.set(key, entry);
  const over = entry.count - RATE_MAX_ATTEMPTS;
  return over > 0
    ? { allowed: false, retryAfterSec: Math.max(Math.min(900, 30 * 2 ** Math.min(over, 5)), Math.ceil((entry.resetAt - now) / 1000)) }
    : { allowed: true, retryAfterSec: 0 };
}

async function upstash(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const response = await fetch(`${url.replace(/\/$/, '')}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('upstash_failed');
  return (await response.json()).result;
}

/** Upstash-backed when configured; local fallback keeps development usable. */
export async function checkRateLimit(ip) {
  try {
    const key = hashedKey('auth-rate', ip);
    const count = Number(await upstash(['incr', key]));
    if (!Number.isFinite(count)) return memoryRateLimit(ip);
    if (count === 1) await upstash(['expire', key, String(Math.ceil(RATE_WINDOW_MS / 1000))]);
    const over = count - RATE_MAX_ATTEMPTS;
    return over > 0
      ? { allowed: false, retryAfterSec: Math.min(900, 30 * 2 ** Math.min(over, 5)) }
      : { allowed: true, retryAfterSec: 0 };
  } catch {
    return memoryRateLimit(ip);
  }
}

function hmacSign(secret, message) {
  return createHmac('sha256', secret).update(message).digest('base64url');
}

function parseSecretMap() {
  const raw = process.env.SESSION_SECRETS;
  if (!raw) return {};
  try {
    const parsed = raw.trim().startsWith('{') ? JSON.parse(raw) : Object.fromEntries(raw.split(',').map((pair) => pair.split(/:(.+)/)).filter(([kid, secret]) => kid && secret));
    return Object.fromEntries(Object.entries(parsed).filter(([kid, secret]) => typeof kid === 'string' && typeof secret === 'string' && secret));
  } catch {
    return {};
  }
}

export function sessionSigningSecret() {
  const secret = process.env.SESSION_SECRET || (!production() && (process.env.SITE_PASSWORD || process.env.PASS_W)) || '';
  return secret;
}

function verificationSecrets() {
  const secrets = parseSecretMap();
  const signing = sessionSigningSecret();
  if (signing) secrets[currentKid()] = signing;
  return secrets;
}

export function sitePassword() {
  return process.env.SITE_PASSWORD || process.env.PASS_W || '';
}

export function createSessionToken(secret = sessionSigningSecret()) {
  if (!secret) return null;
  const exp = Date.now() + SESSION_TTL_MS;
  const kid = currentKid();
  const payload = `${kid}.${exp}.${randomUUID()}`;
  return { token: `${payload}.${hmacSign(secret, payload)}`, expiresAt: exp };
}

export function verifySessionToken(_secret, token) {
  const shape = validateTokenShape(token);
  if (!shape.ok) return false;
  const parsed = parseTokenParts(token);
  const now = Date.now();
  if (!parsed || !Number.isSafeInteger(parsed.exp) || parsed.exp <= now || parsed.exp - now > MAX_SESSION_TTL_MS) return false;
  if (parsed.kind === 'legacy' && !isLegacyAllowed(process.env.ALLOW_LEGACY_TOKENS)) return false;
  const secret = parsed.kind === 'legacy' ? sessionSigningSecret() : verificationSecrets()[parsed.kid];
  return Boolean(secret) && timingSafeEqual(parsed.sig, hmacSign(secret, parsed.payload));
}

export function readCookie(req, name) {
  const value = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  try { return value ? decodeURIComponent(value) : ''; } catch { return ''; }
}

export function requestToken(req, body) {
  const auth = String(req.headers.authorization || '');
  return String(body?.token || (auth.startsWith('Bearer ') ? auth.slice(7).trim() : '') || readCookie(req, 'couple_spin_session') || '').trim();
}

function pruneDenied(now) {
  if (deniedTokens.size >= 500) for (const [key, expiresAt] of deniedTokens) if (expiresAt <= now) deniedTokens.delete(key);
}

export async function denySessionToken(token) {
  const parsed = parseTokenParts(token);
  const ttl = parsed && Number.isSafeInteger(parsed.exp) ? Math.max(1, Math.ceil((parsed.exp - Date.now()) / 1000)) : 0;
  if (!ttl) return;
  const key = hashedKey('auth-deny', token);
  deniedTokens.set(key, Date.now() + ttl * 1000);
  try { await upstash(['set', key, '1', 'EX', String(ttl)]); } catch { /* memory fallback already set */ }
}

export async function isSessionDenied(token) {
  const key = hashedKey('auth-deny', token);
  pruneDenied(Date.now());
  if (deniedTokens.has(key)) return true;
  try { return Boolean(await upstash(['get', key])); } catch { return false; }
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
