import { describe, expect, it } from 'vitest';
import {
  emailToUsername,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
} from './userAuth';

describe('userAuth', () => {
  it('validates usernames', () => {
    expect(isValidUsername('dana')).toBe(true);
    expect(isValidUsername('dana_love')).toBe(true);
    expect(isValidUsername('דנה')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('bad name')).toBe(false);
    expect(isValidUsername('')).toBe(false);
  });

  it('maps username to synthetic email and back', () => {
    const email = usernameToEmail('Test_Host');
    expect(email.endsWith('@users.couplespin.app')).toBe(true);
    expect(emailToUsername(email)).toBe('test_host');
    expect(normalizeUsername('Test_Host')).toBe('test_host');
  });

  it('still recognizes plain emails', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
    expect(emailToUsername('old@example.com')).toBe('old');
  });
});
