import { RATE_WINDOW_MS } from './auth-core.mjs';

// Atomic expiry keeps the counter bounded even if a caller disconnects after incrementing.
const incrementWindow = "local n = redis.call('INCR', KEYS[1]); if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n";

export function hasSharedAuthStore(env) {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

async function command(env, args) {
  if (!hasSharedAuthStore(env)) throw new Error('auth_store_unavailable');
  const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    redirect: 'error',
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error('auth_store_unavailable');
  const data = await response.json();
  if (!data || data.error || !Object.hasOwn(data, 'result')) throw new Error('auth_store_unavailable');
  return data.result;
}

export async function sharedAttempt(env, key, maxAttempts) {
  const count = await command(env, ['EVAL', incrementWindow, '1', key, String(Math.ceil(RATE_WINDOW_MS / 1000))]);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('auth_store_unavailable');
  const over = count - maxAttempts;
  return over > 0
    ? { allowed: false, retryAfterSec: Math.min(900, 30 * 2 ** Math.min(over, 5)) }
    : { allowed: true, retryAfterSec: 0 };
}

export async function revokeSharedToken(env, key, ttl) {
  const result = await command(env, ['SET', key, '1', 'EX', String(ttl)]);
  if (result !== 'OK') throw new Error('auth_store_unavailable');
}

export async function isSharedTokenRevoked(env, key) {
  const result = await command(env, ['GET', key]);
  if (result === null) return false;
  if (result === '1') return true;
  throw new Error('auth_store_unavailable');
}
