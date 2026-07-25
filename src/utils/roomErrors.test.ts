import { describe, expect, it } from 'vitest';
import { getRoomError } from './roomErrors';

describe('roomErrors', () => {
  it('maps known error codes', () => {
    const err = getRoomError('room_expired');
    expect(err?.title).toBe('החדר פג תוקף');
    expect(err?.retryable).toBe(false);
  });

  it('returns fallback for unknown codes', () => {
    const err = getRoomError('something_weird');
    expect(err?.message).toContain('משהו השתבש');
  });
});
