import { describe, expect, it } from 'vitest';
import {
  getSoleAdminUid,
  isSoleAdminEmail,
  isSoleAdminUid,
  SOLE_ADMIN_EMAIL,
  SOLE_ADMIN_UID_DEFAULT,
} from './admin';

describe('admin', () => {
  it('locks to the sole admin UID', () => {
    expect(SOLE_ADMIN_UID_DEFAULT).toBe('tpbKWXtXWFapFC7Fd80Wd4IMqxC2');
    expect(getSoleAdminUid()).toBe('tpbKWXtXWFapFC7Fd80Wd4IMqxC2');
    expect(isSoleAdminUid('tpbKWXtXWFapFC7Fd80Wd4IMqxC2')).toBe(true);
    expect(isSoleAdminUid('someone-else')).toBe(false);
    expect(isSoleAdminUid(null)).toBe(false);
  });

  it('keeps admin email for login identity only', () => {
    expect(SOLE_ADMIN_EMAIL).toBe('elia448811@gmail.com');
    expect(isSoleAdminEmail('elia448811@gmail.com')).toBe(true);
    expect(isSoleAdminEmail('other@gmail.com')).toBe(false);
  });
});
