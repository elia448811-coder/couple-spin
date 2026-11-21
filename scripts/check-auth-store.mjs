import assert from 'node:assert/strict';
import { checkRateLimit, createSessionToken, denySessionToken, isSessionDenied } from '../api/_lib/auth.js';
import worker from '../worker/index.js';

export async function checkAuthStore() {
  const keys = ['NODE_ENV', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'SESSION_SECRET'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const send = globalThis.fetch;
  const records = new Map();
  try {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'synthetic-test-signing-key';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    assert.equal((await checkRateLimit('local-join', { maxAttempts: 1 })).allowed, true);
    assert.equal((await checkRateLimit('local-join', { maxAttempts: 1 })).allowed, false);
    await assert.rejects(checkRateLimit('test', { requireShared: true }), /auth_store_unavailable/);
    const token = createSessionToken().token;
    await assert.rejects(isSessionDenied(token), /auth_store_unavailable/);
    await assert.rejects(denySessionToken(token), /auth_store_unavailable/);

    const env = { SESSION_SECRET: process.env.SESSION_SECRET };
    const sessionRequest = () => new Request('https://example.test/session', { headers: { Authorization: 'Bearer ' + token } });
    assert.equal((await worker.fetch(sessionRequest(), env)).status, 503);
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.invalid';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-store-key';
    Object.assign(env, { UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN });
    globalThis.fetch = async (_url, request) => {
      const [operation, ...args] = JSON.parse(request.body);
      let result;
      if (operation === 'EVAL') {
        const [, keyCount, key, ttl] = args;
        assert.equal(keyCount, '1');
        assert.ok(Number(ttl) > 0);
        result = (records.get(key) ?? 0) + 1;
        records.set(key, result);
      } else if (operation === 'SET') {
        const [key, value, expiry, ttl] = args;
        assert.equal(expiry, 'EX');
        assert.ok(Number(ttl) > 0);
        records.set(key, value);
        result = 'OK';
      } else {
        assert.equal(operation, 'GET');
        result = records.get(args[0]) ?? null;
      }
      return Response.json({ result });
    };
    assert.equal((await checkRateLimit('test', { requireShared: true, maxAttempts: 1 })).allowed, true);
    assert.equal((await checkRateLimit('test', { requireShared: true, maxAttempts: 1 })).allowed, false);
    assert.equal((await worker.fetch(sessionRequest(), env)).status, 200);
    await denySessionToken(token);
    assert.equal((await worker.fetch(sessionRequest(), env)).status, 401);

    globalThis.fetch = async () => Response.json({ error: 'unavailable' });
    await assert.rejects(isSessionDenied(token), /auth_store_unavailable/);
    assert.equal((await worker.fetch(sessionRequest(), env)).status, 503);
    globalThis.fetch = async () => Response.json({ result: null });
    await assert.rejects(checkRateLimit('test', { requireShared: true }), /auth_store_unavailable/);
  } finally {
    globalThis.fetch = send;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
