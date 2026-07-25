import { cors, json, methodNotAllowed, sitePassword } from './_lib/auth.js';

export default function handler(req, res) {
  const headers = cors(req, ['GET', 'OPTIONS']);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET', 'OPTIONS'], headers);
    return;
  }
  json(res, 200, { ok: true, gate: Boolean(sitePassword()), sessionTtlHours: 24 }, headers);
}
