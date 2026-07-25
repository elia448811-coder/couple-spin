import {
  cors,
  isOriginAllowed,
  isSessionDenied,
  json,
  methodNotAllowed,
  readBody,
  requestToken,
  sessionSigningSecret,
  verifySessionToken,
} from './_lib/auth.js';

export default async function handler(req, res) {
  const headers = cors(req, ['GET', 'POST', 'OPTIONS']);

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

  let body;
  if (req.method === 'GET') {
  } else if (req.method === 'POST') {
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { ok: false, error: 'bad_request' }, headers);
      return;
    }
  } else {
    methodNotAllowed(res, ['GET', 'POST', 'OPTIONS'], headers);
    return;
  }

  const token = requestToken(req, body);
  if (!token) {
    json(res, 401, { ok: false, error: 'missing_token' }, headers);
    return;
  }

  const valid = verifySessionToken(secret, token);
  if (!valid || await isSessionDenied(token)) {
    json(res, 401, { ok: false, error: 'invalid_session' }, headers);
    return;
  }

  json(res, 200, { ok: true }, headers);
}
