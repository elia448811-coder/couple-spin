import { describe, expect, it } from 'vitest';
import {
  isSoleAdminEmail,
  isSoleAdminUid,
  SOLE_ADMIN_EMAIL,
  SOLE_ADMIN_UID_DEFAULT,
} from './admin';

describe('admin', () => {
  it('recognizes the login alias and grants authority only to the provisioned UID', () => {
    expect(SOLE_ADMIN_UID_DEFAULT).toBe('tpbKWXtXWFapFC7Fd80Wd4IMqxC2');
    expect(SOLE_ADMIN_EMAIL).toBe('elia448811@gmail.com');
    expect(isSoleAdminUid('tpbKWXtXWFapFC7Fd80Wd4IMqxC2')).toBe(true);
    expect(isSoleAdminEmail('elia448811@gmail.com')).toBe(true);
    expect(isSoleAdminUid('other-uid')).toBe(false);
  });
});
