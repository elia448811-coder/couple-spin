import { cors, json, sitePassword } from './_lib/auth.js';

export default function handler(req, res) {
  const headers = cors(req);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  json(res, 200, { ok: true, gate: Boolean(sitePassword()), sessionTtlHours: 24 }, headers);
}
