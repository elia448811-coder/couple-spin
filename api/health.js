import { cors, json, methodNotAllowed } from './_lib/auth.js';

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
  // Minimal probe — no internals about gate / rate-limit backends.
  json(res, 200, { ok: true }, headers);
}
