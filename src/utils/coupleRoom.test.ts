import { describe, expect, it } from 'vitest';
import {
  bothPlayersReady,
  isPlayerOnline,
  isValidRemoteGameState,
  playersFromRoom,
  presenceLabel,
  PRESENCE_TIMEOUT_MS,
  sanitizeGameForSync,
  type CoupleRoom,
} from './coupleRoom';

const baseRoom: CoupleRoom = {
  roomId: 'room-1',
  displayCode: '12345678',
  code: '12345678',
  hostUid: 'host',
  partnerUid: 'partner',
  hostName: 'אליה',
  partnerName: 'בטי',
  status: 'lobby',
  createdAtMs: 0,
  updatedAtMs: 0,
  expiresAtMs: Date.now() + 60_000,
  version: 0,
  eveningTitle: 'ערב',
  lastEventId: null,
  updatedBy: null,
  hostReady: true,
  partnerReady: false,
  hostLastSeenMs: Date.now(),
  partnerLastSeenMs: Date.now(),
};

describe('coupleRoom helpers', () => {
  it('builds players from room document', () => {
    const players = playersFromRoom(baseRoom);
    expect(players).toHaveLength(2);
    expect(players[0]?.ready).toBe(true);
    expect(players[1]?.ready).toBe(false);
  });

  it('detects online presence', () => {
    const player = playersFromRoom(baseRoom)[0]!;
    expect(isPlayerOnline(player)).toBe(true);
    expect(presenceLabel(player)).toBe('מוכן/ה');
  });

  it('detects offline presence', () => {
    const player = {
      ...playersFromRoom(baseRoom)[0]!,
      lastSeenMs: Date.now() - PRESENCE_TIMEOUT_MS - 1,
      ready: false,
    };
    expect(isPlayerOnline(player)).toBe(false);
    expect(presenceLabel(player)).toBe('לא מחובר/ת');
  });

  it('requires both players ready', () => {
    expect(bothPlayersReady(baseRoom)).toBe(false);
    expect(bothPlayersReady({ ...baseRoom, partnerReady: true })).toBe(true);
  });

  it('rejects malformed remote game snapshots', () => {
    expect(isValidRemoteGameState(null)).toBe(false);
    expect(isValidRemoteGameState({ screen: 'game' })).toBe(false);
    expect(
      isValidRemoteGameState({
        screen: 'game',
        scores: [1, 2],
        playerOneName: 'א',
        playerTwoName: 'ב',
        currentPlayerIndex: 0,
        usedTaskIds: [],
        stats: {},
      }),
    ).toBe(true);
  });

  it('trims long usedTaskIds before sync', () => {
    const slim = sanitizeGameForSync({
      screen: 'game',
      scores: [0, 0],
      playerOneName: 'א',
      playerTwoName: 'ב',
      currentPlayerIndex: 0,
      usedTaskIds: Array.from({ length: 250 }, (_, i) => `t-${i}`),
      sessionNewAchievements: [],
      unlockedAchievements: [],
      stats: { streak: 1 },
    } as never);
    expect(slim.usedTaskIds).toHaveLength(200);
  });
});
