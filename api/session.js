import { cors, json, readBody, sitePassword, verifySessionToken } from './_lib/auth.js';

export default async function handler(req, res) {
  const headers = cors(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const expected = sitePassword();
  if (!expected) {
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

  const valid = verifySessionToken(expected, token);
  if (!valid) {
    json(res, 401, { ok: false, error: 'invalid_session' }, headers);
    return;
  }

  json(res, 200, { ok: true }, headers);
}
