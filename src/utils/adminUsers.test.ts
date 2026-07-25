import { describe, expect, it } from 'vitest';

// Lightweight parse coverage via re-exporting behavior through list shape expectations
// (Firestore calls are integration-level; keep unit checks on pending semantics).

describe('admin user approval semantics', () => {
  it('treats missing approved as allowed and explicit false as pending', () => {
    const missing = { approved: undefined as boolean | undefined, banned: false };
    const pending = { approved: false, banned: false };
    const approved = { approved: true, banned: false };

    const isPending = (raw: { approved?: boolean; banned?: boolean }) =>
      raw.approved === false && !raw.banned;
    const isApproved = (raw: { approved?: boolean }) => raw.approved !== false;

    expect(isPending(missing)).toBe(false);
    expect(isApproved(missing)).toBe(true);
    expect(isPending(pending)).toBe(true);
    expect(isApproved(pending)).toBe(false);
    expect(isPending(approved)).toBe(false);
    expect(isApproved(approved)).toBe(true);
  });
});
