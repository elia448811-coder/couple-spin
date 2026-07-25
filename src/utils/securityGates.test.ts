import { describe, expect, it } from 'vitest';
import { getSoleAdminUid, isSoleAdminUid } from './admin';

describe('security gates for admin targets', () => {
  it('identifies sole admin uid as protected', () => {
    expect(isSoleAdminUid(getSoleAdminUid())).toBe(true);
    expect(isSoleAdminUid('random-user')).toBe(false);
  });
});
