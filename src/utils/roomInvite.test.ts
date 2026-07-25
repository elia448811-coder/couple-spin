import { describe, expect, it } from 'vitest';
import { buildInviteUrl, buildWhatsAppShareText } from './roomInvite';

describe('roomInvite', () => {
  it('builds join url with code param', () => {
    const url = buildInviteUrl('48392155');
    expect(url).toContain('join=48392155');
  });

  it('builds whatsapp share text with code and link', () => {
    const text = buildWhatsAppShareText('48392155', 'אליה');
    expect(text).toContain('48392155');
    expect(text).toContain('אליה');
    expect(text).toContain('join=48392155');
  });
});
