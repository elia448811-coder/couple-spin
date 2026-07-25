import {
  cors,
  isOriginAllowed,
  json,
  readBody,
  sessionSigningSecret,
  verifySessionToken,
} from './_lib/auth.js';

export default async function handler(req, res) {
  const headers = cors(req);

  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(req)) {
      json(res, 403, { ok: false, error: 'origin_forbidden' }, { 'Cache-Control': 'no-store' });
      return;
    }
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (!isOriginAllowed(req)) {
    json(res, 403, { ok: false, error: 'origin_forbidden' }, { 'Cache-Control': 'no-store' });
    return;
  }

  const secret = sessionSigningSecret();
  if (!secret) {
    json(res, 503, { ok: false, error: 'not_configured' }, headers);
    return;
  }

  let token = '';
  if (req.method === 'GET') {
    const auth = req.headers.authorization || '';
    token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  } else if (req.method === 'POST') {
    try {
      const body = await readBody(req);
      token = String(body?.token ?? '').trim();
    } catch {
      json(res, 400, { ok: false, error: 'bad_request' }, headers);
      return;
    }
  } else {
    json(res, 405, { ok: false, error: 'method_not_allowed' }, headers);
    return;
  }

  if (!token) {
    json(res, 401, { ok: false, error: 'missing_token' }, headers);
    return;
  }

  const valid = verifySessionToken(secret, token);
  if (!valid) {
    json(res, 401, { ok: false, error: 'invalid_session' }, headers);
    return;
  }

  json(res, 200, { ok: true }, headers);
}
