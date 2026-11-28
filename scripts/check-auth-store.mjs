import assert from 'node:assert/strict';
import { checkRateLimit, createSessionToken, denySessionToken, isSessionDenied, verifySessionToken } from '../api/_lib/auth.js';
import joinGuard from '../api/join-guard.js';
import { verificationKey } from '../shared/auth-core.mjs';
import worker from '../worker/index.js';

async function joinResponse(method, origin, contentType = 'application/json') {
  const req = { method, headers: { origin, 'content-type': contentType }, socket: { remoteAddress: 'join-test' } };
  const res = { setHeader() {}, writeHead(status) { this.statusCode = status; }, end() {} };
  await joinGuard(req, res);
  return res.statusCode;
}

export async function checkAuthStore() {
  const keys = ['NODE_ENV', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'SESSION_SECRET', 'CURRENT_KID', 'SESSION_SECRETS', 'ALLOWED_ORIGINS'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const send = globalThis.fetch;
  const records = new Map();
  try {
    process.env.NODE_ENV = 'production';
    process.env.CURRENT_KID = 'v1';
    delete process.env.SESSION_SECRETS;
    process.env.ALLOWED_ORIGINS = 'https://game.example.test';
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
    const beforeJoin = new Map(records);
    for (const origin of [undefined, 'null', 'malformed', 'https://elsewhere.example.test', 'https://game.example.test/path']) {
      assert.equal(await joinResponse('POST', origin), 403);
      assert.equal(await joinResponse('OPTIONS', origin), 403);
    }
    assert.equal(await joinResponse('OPTIONS', process.env.ALLOWED_ORIGINS), 204);
    assert.equal(await joinResponse('POST', process.env.ALLOWED_ORIGINS, 'text/plain'), 415);
    assert.deepEqual(records, beforeJoin);
    assert.equal(await joinResponse('POST', process.env.ALLOWED_ORIGINS), 200);
    assert.equal(records.size, beforeJoin.size + 1);

    const oldKey = process.env.SESSION_SECRET;
    process.env.CURRENT_KID = env.CURRENT_KID = 'v2';
    process.env.SESSION_SECRET = env.SESSION_SECRET = 'synthetic-rotated-key';
    for (const config of [`v1:${oldKey}`, JSON.stringify({ v1: oldKey })]) {
      process.env.SESSION_SECRETS = env.SESSION_SECRETS = config;
      assert.equal(verifySessionToken(undefined, token), true);
      assert.equal((await worker.fetch(sessionRequest(), env)).status, 200);
    }
    for (const kid of ['__proto__', 'constructor', 'toString', 'unknown']) {
      assert.equal(verificationKey(kid, 'v2', env.SESSION_SECRET, env.SESSION_SECRETS), null);
      const invalidToken = token.replace(/^v1\./, kid + '.');
      assert.equal(verifySessionToken(undefined, invalidToken), false);
      const invalidRequest = new Request('https://example.test/session', { headers: { Authorization: 'Bearer ' + invalidToken } });
      assert.equal((await worker.fetch(invalidRequest, env)).status, 401);
    }
    for (const invalidKey of [true, {}, [], 1, '', null]) {
      assert.equal(verificationKey('v1', 'v2', env.SESSION_SECRET, JSON.stringify({ v1: invalidKey })), null);
    }
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
