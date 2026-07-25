import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedUserProfile } from './userProfile';

describe('userProfile cache', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
    });
  });

  it('returns null when empty', () => {
    expect(getCachedUserProfile()).toBeNull();
  });

  it('reads cached profile', () => {
    memory.set(
      'couple-spin-user-profile',
      JSON.stringify({
        uid: 'u1',
        displayName: 'אליה',
        partnerDisplayName: 'בטי',
        avatar: '💜',
        createdAtMs: 1,
        lastSeenMs: 2,
        updatedAtMs: 2,
        schemaVersion: 1,
        lastRoomId: null,
        gamesPlayed: 3,
      }),
    );
    const profile = getCachedUserProfile();
    expect(profile?.displayName).toBe('אליה');
    expect(profile?.gamesPlayed).toBe(3);
  });
});
