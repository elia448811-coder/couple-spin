import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  checkJoinRateLimit,
  recordJoinFailure,
  resetJoinRateLimit,
  MAX_JOIN_ATTEMPTS,
} from './roomJoinRateLimit';

describe('roomJoinRateLimit', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => {
        memory.clear();
      },
    });
    resetJoinRateLimit();
  });

  it('allows joins initially', () => {
    expect(checkJoinRateLimit().allowed).toBe(true);
  });

  it('locks after max failed attempts', () => {
    for (let i = 0; i < MAX_JOIN_ATTEMPTS; i += 1) {
      recordJoinFailure();
    }
    expect(checkJoinRateLimit().allowed).toBe(false);
  });

  it('resets after successful join', () => {
    recordJoinFailure();
    resetJoinRateLimit();
    expect(checkJoinRateLimit().allowed).toBe(true);
  });
});
