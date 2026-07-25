import {
  cors,
  denySessionToken,
  isOriginAllowed,
  json,
  methodNotAllowed,
  readBody,
  requestToken,
} from './_lib/auth.js';

const CLEAR_COOKIE = 'couple_spin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';

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

  let body;
  try {
    body = await readBody(req);
  } catch {
    json(res, 400, { ok: false, error: 'bad_request' }, { ...headers, 'Set-Cookie': CLEAR_COOKIE });
    return;
  }

  const token = requestToken(req, body);
  if (token) await denySessionToken(token);
  json(res, 200, { ok: true }, { ...headers, 'Set-Cookie': CLEAR_COOKIE });
}
