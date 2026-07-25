import {
  checkRateLimit,
  clientIp,
  cors,
  createSessionToken,
  json,
  MAX_PASSWORD_LEN,
  readBody,
  sitePassword,
  timingSafeEqual,
} from './_lib/auth.js';

export default async function handler(req, res) {
  const headers = cors(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'method_not_allowed' }, headers);
    return;
  }

  const ip = clientIp(req);
  const rate = checkRateLimit(ip);
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
  if (!expected) {
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
    const session = createSessionToken(expected);
    json(res, 200, { ok: true, token: session.token, expiresAt: session.expiresAt }, headers);
    return;
  }

  json(res, 401, { ok: false, error: 'wrong_password' }, headers);
}
