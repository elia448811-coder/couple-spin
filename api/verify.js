import {
  checkRateLimit,
  clientIp,
  cors,
  createSessionToken,
  isOriginAllowed,
  json,
  MAX_PASSWORD_LEN,
  methodNotAllowed,
  readBody,
  sessionSigningSecret,
  sitePassword,
  timingSafeEqual,
} from './_lib/auth.js';

export default async function handler(req, res) {
  const headers = cors(req, ['POST', 'OPTIONS']);

  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(req)) {
      json(res, 403, { ok: false, error: 'origin_forbidden' }, { 'Cache-Control': 'no-store' });
      return;
    }
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS'], headers);
    return;
  }

  if (!isOriginAllowed(req)) {
    json(res, 403, { ok: false, error: 'origin_forbidden' }, { 'Cache-Control': 'no-store' });
    return;
  }

  const ip = clientIp(req);
  const rate = await checkRateLimit(ip);
  if (!rate.allowed) {
    json(
      res,
      429,
      { ok: false, error: 'rate_limited', retryAfterSec: rate.retryAfterSec },
      { ...headers, 'Retry-After': String(rate.retryAfterSec) },
    );
    return;
  }

  const expected = sitePassword();
  const signing = sessionSigningSecret();
  if (!expected || !signing) {
    json(res, 503, { ok: false, error: 'not_configured' }, headers);
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    json(res, 400, { ok: false, error: 'bad_request' }, headers);
    return;
  }

  const input = String(body.password ?? '').trim();
  if (!input || input.length > MAX_PASSWORD_LEN) {
    json(res, 400, { ok: false, error: 'bad_request' }, headers);
    return;
  }

  if (timingSafeEqual(input, expected)) {
    const session = createSessionToken(signing);
    if (!session) {
      json(res, 503, { ok: false, error: 'not_configured' }, headers);
      return;
    }
    json(
      res,
      200,
      { ok: true, token: session.token, expiresAt: session.expiresAt },
      { ...headers, 'Set-Cookie': `couple_spin_session=${encodeURIComponent(session.token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor((session.expiresAt - Date.now()) / 1000)}` },
    );
    return;
  }

  json(res, 401, { ok: false, error: 'wrong_password' }, headers);
}
