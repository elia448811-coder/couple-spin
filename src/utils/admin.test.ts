import { describe, expect, it } from 'vitest';
import {
  isSoleAdminEmail,
  isSoleAdminIdentity,
  isSoleAdminUid,
  SOLE_ADMIN_EMAIL,
  SOLE_ADMIN_UID_DEFAULT,
} from './admin';

describe('admin', () => {
  it('accepts locked UID or locked email', () => {
    expect(SOLE_ADMIN_UID_DEFAULT).toBe('tpbKWXtXWFapFC7Fd80Wd4IMqxC2');
    expect(SOLE_ADMIN_EMAIL).toBe('elia448811@gmail.com');
    expect(isSoleAdminUid('tpbKWXtXWFapFC7Fd80Wd4IMqxC2')).toBe(true);
    expect(isSoleAdminEmail('elia448811@gmail.com')).toBe(true);
    expect(isSoleAdminIdentity('other-uid', 'elia448811@gmail.com')).toBe(true);
    expect(isSoleAdminIdentity('tpbKWXtXWFapFC7Fd80Wd4IMqxC2', 'x@y.com')).toBe(true);
    expect(isSoleAdminIdentity('other-uid', 'other@gmail.com')).toBe(false);
  });
});
