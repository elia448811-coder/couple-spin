/**
 * IP-based join attempt gate — slows room-code brute force across fresh anon UIDs.
 * Uses Upstash when configured; otherwise in-memory (single instance).
 */
import { checkRateLimit, clientIp, cors, json, methodNotAllowed } from './_lib/auth.js';

const JOIN_MAX_ATTEMPTS = 30;

export default async function handler(req, res) {
  const headers = cors(req, ['POST', 'OPTIONS']);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS'], headers);
    return;
  }

  try {
    const limit = await checkRateLimit(clientIp(req), {
      prefix: 'join-rate',
      maxAttempts: JOIN_MAX_ATTEMPTS,
    });
    if (!limit.allowed) {
      json(
        res,
        429,
        { ok: false, error: 'join_rate_limited', retryAfterSec: limit.retryAfterSec },
        { ...headers, 'Retry-After': String(limit.retryAfterSec || 60) },
      );
      return;
    }
    json(res, 200, { ok: true }, headers);
  } catch {
    // Fail open for join UX if rate backend blips — uid/local limits still apply.
    json(res, 200, { ok: true, degraded: true }, headers);
  }
}
