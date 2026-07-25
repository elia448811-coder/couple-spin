import { describe, expect, it } from 'vitest';
import { buildQuestionsExportText } from './exportQuestionsFile';

describe('exportQuestionsFile', () => {
  it('builds a non-empty questions export', () => {
    const text = buildQuestionsExportText();
    expect(text).toContain('ספין זוגי');
    expect(text).toContain('שאלות');
    expect(text.split('\n').some((l) => /^\d+\.\s/.test(l.trim()))).toBe(true);
  });
});
