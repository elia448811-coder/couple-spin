import { describe, expect, it } from 'vitest';
import { isValidEmail } from './userAuth';

describe('userAuth', () => {
  it('validates emails', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});
