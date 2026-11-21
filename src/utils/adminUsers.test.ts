import { describe, expect, it } from 'vitest';
import { hasAccountApproval } from './adminUsers';

describe('account approval', () => {
  it('requires explicit administrator approval, including for legacy profiles', () => {
    expect(hasAccountApproval({ approved: true })).toBe(true);
    expect(hasAccountApproval({ approved: false })).toBe(false);
    expect(hasAccountApproval({ approved: 'true' })).toBe(false);
    expect(hasAccountApproval({})).toBe(false);
    expect(hasAccountApproval(undefined)).toBe(false);
  });
});
