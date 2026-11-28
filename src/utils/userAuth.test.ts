import { describe, expect, it, vi } from 'vitest';
import * as firebase from '../lib/firebase';
import {
  emailToUsername,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  registerWithUsername,
  usernameToEmail,
} from './userAuth';

describe('userAuth', () => {
  it('refuses a reserved email before contacting Firebase Auth', async () => {
    const configured = vi.spyOn(firebase, 'isFirebaseConfigured').mockReturnValue(true);
    const auth = vi.spyOn(firebase, 'getFirebaseAuth');
    try {
      expect((await registerWithUsername(' Elia448811@gmail.com ', 'example')).ok).toBe(false);
      expect(auth).not.toHaveBeenCalled();
    } finally {
      auth.mockRestore();
      configured.mockRestore();
    }
  });

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
