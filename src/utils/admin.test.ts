import { describe, expect, it } from 'vitest';
import { isSoleAdminEmail, SOLE_ADMIN_EMAIL } from './admin';

describe('admin', () => {
  it('recognizes only the sole admin email', () => {
    expect(SOLE_ADMIN_EMAIL).toBe('elia448811@gmail.com');
    expect(isSoleAdminEmail('elia448811@gmail.com')).toBe(true);
    expect(isSoleAdminEmail('Elia448811@Gmail.com')).toBe(true);
    expect(isSoleAdminEmail('test_host')).toBe(false);
    expect(isSoleAdminEmail('other@gmail.com')).toBe(false);
    expect(isSoleAdminEmail(null)).toBe(false);
  });
});
